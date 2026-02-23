import { useState, useCallback } from 'react'
import { generateSchedule } from '@time-slots/schedule/generate'
import { generateLocationFulfillmentSchedule } from '@time-slots/schedule/location'
import { PrepTimeBehaviour, PREP_TIME_CADENCE } from '@time-slots/constants'
import type { BusinessHour, BusinessHoursOverrideOutput, DaySchedule } from '@time-slots/types'
import type { FulfillmentPreference } from '@time-slots/types/location'
import { format } from 'date-fns'
import './App.css'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
]

interface BusinessHourRow {
  day: number
  startTime: string
  endTime: string
  enabled: boolean
}

interface OverrideRow {
  month: number
  day: number
  startTime: string | null
  endTime: string | null
}

interface WeekDayPrepTimeRow {
  day: number
  minutes: number
  enabled: boolean
}

type GenerateMode = 'generateSchedule' | 'locationFulfillment'

function getDefaultBusinessHours(): BusinessHourRow[] {
  return DAYS.map((_, i) => ({
    day: i,
    startTime: '09:00',
    endTime: '17:00',
    enabled: i >= 1 && i <= 5,
  }))
}

function getDefaultWeekDayPrepTimes(): WeekDayPrepTimeRow[] {
  return DAYS.map((_, i) => ({
    day: i,
    minutes: 5,
    enabled: false,
  }))
}

function App() {
  const [mode, setMode] = useState<GenerateMode>('generateSchedule')

  const [timeZone, setTimeZone] = useState('America/New_York')
  const [gapInMinutes, setGapInMinutes] = useState(15)
  const [businessHours, setBusinessHours] = useState<BusinessHourRow[]>(getDefaultBusinessHours)
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [daysCount, setDaysCount] = useState(7)

  const [prepTimeBehaviour, setPrepTimeBehaviour] = useState(PrepTimeBehaviour.ROLL_FROM_FIRST_SHIFT)
  const [prepTimeCadence, setPrepTimeCadence] = useState<string>(PREP_TIME_CADENCE.MINUTE)
  const [prepTimeFrequency, setPrepTimeFrequency] = useState(0)
  const [weekDayPrepTimes, setWeekDayPrepTimes] = useState<WeekDayPrepTimeRow[]>(getDefaultWeekDayPrepTimes)

  const [fulfillmentPreference, setFulfillmentPreference] = useState<FulfillmentPreference>('PICKUP')
  const [locationTimezone, setLocationTimezone] = useState('America/New_York')
  const [locationId, setLocationId] = useState('loc-1')

  const [useCustomDate, setUseCustomDate] = useState(false)
  const [customDateStr, setCustomDateStr] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))

  const [schedule, setSchedule] = useState<DaySchedule[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executionTime, setExecutionTime] = useState<number | null>(null)

  const getEnabledBusinessHours = useCallback((): BusinessHour[] => {
    return businessHours
      .filter(bh => bh.enabled)
      .map(bh => ({ day: bh.day, startTime: bh.startTime, endTime: bh.endTime }))
  }, [businessHours])

  const getOverrides = useCallback((): BusinessHoursOverrideOutput[] => {
    return overrides.map(o => ({
      month: o.month,
      day: o.day,
      startTime: o.startTime,
      endTime: o.endTime,
    }))
  }, [overrides])

  const getWeekDayPrepTimesMap = useCallback((): Record<number, number> => {
    const map: Record<number, number> = {}
    for (const wdp of weekDayPrepTimes) {
      if (wdp.enabled) {
        map[wdp.day] = wdp.minutes
      }
    }
    return map
  }, [weekDayPrepTimes])

  const getDatesForSchedule = useCallback((): Date[] => {
    const dates: Date[] = []
    const start = useCustomDate ? new Date(customDateStr) : new Date()
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      dates.push(d)
    }
    return dates
  }, [daysCount, useCustomDate, customDateStr])

  const handleGenerate = useCallback(() => {
    setError(null)
    const startTime = performance.now()

    try {
      if (mode === 'generateSchedule') {
        const currentDate = useCustomDate ? new Date(customDateStr) : new Date()
        const result = generateSchedule({
          currentDate,
          prepTimeBehaviour,
          weekDayPrepTimes: getWeekDayPrepTimesMap(),
          timeZone,
          dates: getDatesForSchedule(),
          businessHours: getEnabledBusinessHours(),
          businessHoursOverrides: getOverrides(),
          gapInMinutes,
          prepTimeCadence: prepTimeCadence as any,
        })
        setSchedule(result)
      } else {
        const enabledHours = getEnabledBusinessHours()
        const pickupHours = enabledHours.map(bh => ({
          day: bh.day,
          start_time: bh.startTime,
          end_time: bh.endTime,
        }))

        const result = generateLocationFulfillmentSchedule({
          startDate: useCustomDate ? new Date(customDateStr) : new Date(),
          prepTimeFrequency,
          prepTimeCadence: prepTimeCadence as any,
          weekDayPrepTimes: getWeekDayPrepTimesMap(),
          location: {
            location_id: locationId,
            timezone: locationTimezone,
            pickup_hours: fulfillmentPreference === 'PICKUP' || fulfillmentPreference === 'CURBSIDE' ? pickupHours : undefined,
            delivery_hours: fulfillmentPreference === 'DELIVERY' ? pickupHours : undefined,
            curbside_hours: fulfillmentPreference === 'CURBSIDE' ? { use_pickup_hours: true } : undefined,
          },
          fulfillmentPreference,
          businessHoursOverrides: getOverrides(),
          gapInMinutes,
          daysCount,
        })
        setSchedule(result)
      }
    } catch (err: any) {
      setError(err.message || String(err))
      setSchedule(null)
    }

    setExecutionTime(performance.now() - startTime)
  }, [mode, useCustomDate, customDateStr, prepTimeBehaviour, getWeekDayPrepTimesMap, timeZone, getDatesForSchedule, getEnabledBusinessHours, getOverrides, gapInMinutes, prepTimeCadence, prepTimeFrequency, locationId, locationTimezone, fulfillmentPreference, daysCount])

  const updateBusinessHour = (index: number, field: keyof BusinessHourRow, value: any) => {
    setBusinessHours(prev => prev.map((bh, i) => i === index ? { ...bh, [field]: value } : bh))
  }

  const updateWeekDayPrepTime = (index: number, field: keyof WeekDayPrepTimeRow, value: any) => {
    setWeekDayPrepTimes(prev => prev.map((wdp, i) => i === index ? { ...wdp, [field]: value } : wdp))
  }

  const addOverride = () => {
    const now = new Date()
    setOverrides(prev => [...prev, { month: now.getMonth() + 1, day: now.getDate(), startTime: '09:00', endTime: '17:00' }])
  }

  const removeOverride = (index: number) => {
    setOverrides(prev => prev.filter((_, i) => i !== index))
  }

  const updateOverride = (index: number, field: keyof OverrideRow, value: any) => {
    setOverrides(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o))
  }

  const totalSlots = schedule?.reduce((sum, day) => sum + day.slots.length, 0) ?? 0

  return (
    <div className="app">
      <header>
        <h1>Time Slots Debugger</h1>
        <p className="subtitle">Interactive schedule generation playground</p>
      </header>

      <div className="layout">
        <div className="controls">
          <section>
            <h2>Generation Mode</h2>
            <div className="radio-group">
              <label>
                <input type="radio" checked={mode === 'generateSchedule'} onChange={() => setMode('generateSchedule')} />
                generateSchedule
              </label>
              <label>
                <input type="radio" checked={mode === 'locationFulfillment'} onChange={() => setMode('locationFulfillment')} />
                locationFulfillmentSchedule
              </label>
            </div>
          </section>

          <section>
            <h2>Date & Time</h2>
            <div className="field">
              <label>
                <input type="checkbox" checked={useCustomDate} onChange={e => setUseCustomDate(e.target.checked)} />
                Custom current date
              </label>
            </div>
            {useCustomDate && (
              <div className="field">
                <label>Current Date</label>
                <input type="datetime-local" value={customDateStr} onChange={e => setCustomDateStr(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>Timezone</label>
              <select value={timeZone} onChange={e => setTimeZone(e.target.value)}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Days</label>
                <input type="number" min={1} max={90} value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Gap (min)</label>
                <input type="number" min={1} max={120} value={gapInMinutes} onChange={e => setGapInMinutes(Number(e.target.value))} />
              </div>
            </div>
          </section>

          {mode === 'locationFulfillment' && (
            <section>
              <h2>Location & Fulfillment</h2>
              <div className="field">
                <label>Location ID</label>
                <input type="text" value={locationId} onChange={e => setLocationId(e.target.value)} />
              </div>
              <div className="field">
                <label>Location Timezone</label>
                <select value={locationTimezone} onChange={e => setLocationTimezone(e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Fulfillment</label>
                <select value={fulfillmentPreference} onChange={e => setFulfillmentPreference(e.target.value as FulfillmentPreference)}>
                  <option value="PICKUP">Pickup</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="CURBSIDE">Curbside</option>
                </select>
              </div>
            </section>
          )}

          <section>
            <h2>Prep Time</h2>
            {mode === 'generateSchedule' && (
              <div className="field">
                <label>Behaviour</label>
                <select value={prepTimeBehaviour} onChange={e => setPrepTimeBehaviour(Number(e.target.value))}>
                  <option value={0}>FIRST_SHIFT (0)</option>
                  <option value={1}>EVERY_SHIFT (1)</option>
                  <option value={2}>ROLL_FROM_FIRST_SHIFT (2)</option>
                </select>
              </div>
            )}
            <div className="field-row">
              <div className="field">
                <label>Cadence</label>
                <select value={prepTimeCadence} onChange={e => setPrepTimeCadence(e.target.value)}>
                  <option value="minute">minute</option>
                  <option value="hour">hour</option>
                  <option value="day">day</option>
                </select>
              </div>
              {mode === 'locationFulfillment' && (
                <div className="field">
                  <label>Frequency</label>
                  <input type="number" min={0} max={999} value={prepTimeFrequency} onChange={e => setPrepTimeFrequency(Number(e.target.value))} />
                </div>
              )}
            </div>
          </section>

          <section>
            <h2>Week Day Prep Times</h2>
            <div className="weekday-grid">
              {weekDayPrepTimes.map((wdp, i) => (
                <div key={i} className="weekday-row">
                  <label>
                    <input type="checkbox" checked={wdp.enabled} onChange={e => updateWeekDayPrepTime(i, 'enabled', e.target.checked)} />
                    {DAYS[i].slice(0, 3)}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={wdp.minutes}
                    disabled={!wdp.enabled}
                    onChange={e => updateWeekDayPrepTime(i, 'minutes', Number(e.target.value))}
                    className="small-input"
                  />
                  <span className="unit">min</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Business Hours</h2>
            <div className="business-hours">
              {businessHours.map((bh, i) => (
                <div key={i} className={`bh-row ${bh.enabled ? '' : 'disabled'}`}>
                  <label>
                    <input type="checkbox" checked={bh.enabled} onChange={e => updateBusinessHour(i, 'enabled', e.target.checked)} />
                    {DAYS[i].slice(0, 3)}
                  </label>
                  <input type="time" value={bh.startTime} onChange={e => updateBusinessHour(i, 'startTime', e.target.value)} disabled={!bh.enabled} />
                  <span className="dash">-</span>
                  <input type="time" value={bh.endTime} onChange={e => updateBusinessHour(i, 'endTime', e.target.value)} disabled={!bh.enabled} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>
              Overrides
              <button className="btn-small" onClick={addOverride}>+ Add</button>
            </h2>
            {overrides.length === 0 && <p className="hint">No overrides configured.</p>}
            {overrides.map((o, i) => (
              <div key={i} className="override-row">
                <input type="number" min={1} max={12} value={o.month} onChange={e => updateOverride(i, 'month', Number(e.target.value))} className="small-input" placeholder="M" />
                <span>/</span>
                <input type="number" min={1} max={31} value={o.day} onChange={e => updateOverride(i, 'day', Number(e.target.value))} className="small-input" placeholder="D" />
                <input type="time" value={o.startTime ?? ''} onChange={e => updateOverride(i, 'startTime', e.target.value || null)} />
                <span className="dash">-</span>
                <input type="time" value={o.endTime ?? ''} onChange={e => updateOverride(i, 'endTime', e.target.value || null)} />
                <button className="btn-remove" onClick={() => removeOverride(i)} title="Remove">x</button>
              </div>
            ))}
          </section>

          <button className="btn-generate" onClick={handleGenerate}>Generate Schedule</button>
        </div>

        <div className="results">
          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}

          {executionTime !== null && (
            <div className="stats">
              <span>{executionTime.toFixed(1)}ms</span>
              <span>{schedule?.length ?? 0} days</span>
              <span>{totalSlots} slots</span>
            </div>
          )}

          {schedule && schedule.length > 0 && (
            <div className="schedule-output">
              {schedule.map((day, i) => (
                <DayCard key={i} day={day} />
              ))}
            </div>
          )}

          {schedule && schedule.length === 0 && (
            <div className="empty-state">No slots generated. Adjust parameters and retry.</div>
          )}

          {!schedule && !error && (
            <div className="empty-state">Configure parameters and click "Generate Schedule".</div>
          )}
        </div>
      </div>
    </div>
  )
}

function DayCard({ day }: { day: DaySchedule }) {
  const [expanded, setExpanded] = useState(false)
  const dateStr = format(day.date, 'EEE, MMM d, yyyy')
  const slotsToShow = expanded ? day.slots : day.slots.slice(0, 12)

  return (
    <div className="day-card">
      <div className="day-header" onClick={() => setExpanded(!expanded)}>
        <div className="day-info">
          <strong>{dateStr}</strong>
          <span className="slot-count">{day.slots.length} slots</span>
        </div>
        <div className="day-meta">
          {day.openingTime && <span>Open: {format(day.openingTime, 'h:mm a')}</span>}
          {day.closingTime && <span>Close: {format(day.closingTime, 'h:mm a')}</span>}
          {day.firstAvailableSlot && <span className="first-avail">First: {format(day.firstAvailableSlot, 'h:mm a')}</span>}
        </div>
        <span className="expand-icon">{expanded ? '\u25BC' : '\u25B6'}</span>
      </div>
      <div className="slots-grid">
        {slotsToShow.map((slot, j) => (
          <span key={j} className="slot-chip">{format(slot, 'h:mm a')}</span>
        ))}
        {!expanded && day.slots.length > 12 && (
          <span className="slot-chip more" onClick={() => setExpanded(true)}>+{day.slots.length - 12} more</span>
        )}
      </div>
    </div>
  )
}

export default App
