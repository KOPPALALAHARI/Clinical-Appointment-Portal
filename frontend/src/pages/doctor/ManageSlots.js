import { useEffect, useMemo, useState } from "react";
import { createSlotsBulk, getMySlots } from "../../api/doctors";
import styles from "./Doctor.module.css";

const DURATION_OPTIONS = [15, 30, 45, 60];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDt(dt) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function datesInRange(from, to) {
  const dates = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function buildPreview(dateFrom, dateTo, fromTime, toTime, duration) {
  if (!dateFrom || !dateTo || !fromTime || !toTime || !duration) return [];
  if (dateTo < dateFrom || toTime <= fromTime) return [];
  const dates = datesInRange(dateFrom, dateTo);
  const slots = [];
  for (const date of dates) {
    let cur = fromTime;
    while (true) {
      const next = addMinutes(cur, duration);
      if (next > toTime) break;
      slots.push({ date, start: cur, end: next });
      cur = next;
    }
  }
  return slots;
}

const initialForm = {
  dateFrom: todayStr(),
  dateTo: todayStr(),
  fromTime: "09:00",
  toTime: "17:00",
  duration: 30,
  maxPatients: 1,
};

export default function ManageSlots() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const preview = useMemo(
    () => buildPreview(form.dateFrom, form.dateTo, form.fromTime, form.toTime, form.duration),
    [form.dateFrom, form.dateTo, form.fromTime, form.toTime, form.duration]
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    getMySlots()
      .then(({ data }) => setSlots(data))
      .catch(() => setLoadError("Failed to load slots"))
      .finally(() => setLoading(false));
  }, []);

  const set = (field) => (e) => {
    const isNumeric = e.target.type === "number" || e.target.tagName === "SELECT";
    const val = isNumeric ? Number(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (form.dateTo < form.dateFrom) {
      setFormError("End date must be on or after start date");
      return;
    }
    if (form.toTime <= form.fromTime) {
      setFormError("To Time must be after From Time");
      return;
    }
    if (preview.length === 0) {
      setFormError("No slots can be generated with these settings");
      return;
    }

    setCreating(true);
    try {
      const { data } = await createSlotsBulk({
        date_from: form.dateFrom,
        date_to: form.dateTo,
        from_time: form.fromTime + ":00",
        to_time: form.toTime + ":00",
        duration_minutes: form.duration,
        max_patients: form.maxPatients,
      });
      showToast(data.message || `${data.created} slots created!`);
      setForm(initialForm);
      setShowPreview(false);
      const { data: updated } = await getMySlots();
      setSlots(updated);
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to create slots");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}
      <h2>Manage Appointment Slots</h2>

      <div className={styles.formCard}>
        <h3>Create Slots</h3>
        {formError && <div className={styles.error}>{formError}</div>}
        <form onSubmit={handleSubmit} className={styles.form}>

          <div className={styles.fieldRow}>
            <label>
              Date From
              <input
                type="date"
                value={form.dateFrom}
                min={todayStr()}
                onChange={set("dateFrom")}
                required
              />
            </label>
            <label>
              Date To
              <input
                type="date"
                value={form.dateTo}
                min={form.dateFrom}
                onChange={set("dateTo")}
                required
              />
            </label>
          </div>

          <div className={styles.fieldRow}>
            <label>
              From Time
              <input
                type="time"
                value={form.fromTime}
                onChange={set("fromTime")}
                required
              />
            </label>
            <label>
              To Time
              <input
                type="time"
                value={form.toTime}
                onChange={set("toTime")}
                required
              />
            </label>
          </div>

          <div className={styles.fieldRow}>
            <label>
              Slot Duration
              <select value={form.duration} onChange={set("duration")} className={styles.select}>
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} minutes</option>
                ))}
              </select>
            </label>
            <label>
              Max Patients per Slot
              <input
                type="number"
                value={form.maxPatients}
                min={1}
                max={50}
                onChange={set("maxPatients")}
                required
              />
            </label>
          </div>

          <div className={styles.previewBar}>
            <span className={styles.previewCount}>
              {preview.length > 0
                ? `${preview.length} slot${preview.length !== 1 ? "s" : ""} will be created`
                : "No slots match current settings"}
            </span>
            {preview.length > 0 && (
              <button
                type="button"
                className={styles.previewToggle}
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>
            )}
          </div>

          {showPreview && preview.length > 0 && (
            <div className={styles.previewBox}>
              {Object.entries(
                preview.reduce((acc, s) => {
                  (acc[s.date] = acc[s.date] || []).push(s);
                  return acc;
                }, {})
              ).map(([date, daySlots]) => (
                <div key={date} className={styles.previewDay}>
                  <div className={styles.previewDate}>
                    {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "short", month: "short", day: "numeric",
                    })}
                    <span className={styles.previewDayCount}>{daySlots.length} slots</span>
                  </div>
                  <div className={styles.previewTimes}>
                    {daySlots.map((s, i) => (
                      <span key={i} className={styles.previewChip}>
                        {s.start} – {s.end}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="submit" disabled={creating || preview.length === 0} className={styles.btn}>
            {creating ? "Creating..." : `Create ${preview.length > 0 ? preview.length : ""} Slots`}
          </button>
        </form>
      </div>

      <h3 className={styles.sectionTitle}>Your Slots</h3>
      {loading ? (
        <p className={styles.center}>Loading...</p>
      ) : loadError ? (
        <p className={styles.errorText}>{loadError}</p>
      ) : slots.length === 0 ? (
        <p className={styles.empty}>No slots created yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Start</th>
              <th>End</th>
              <th>Duration</th>
              <th>Max Patients</th>
              <th>Booked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, i) => (
              <tr key={slot.id}>
                <td>{i + 1}</td>
                <td>{formatDt(slot.start_time)}</td>
                <td>{formatDt(slot.end_time)}</td>
                <td>{slot.duration_minutes} min</td>
                <td>{slot.max_patients}</td>
                <td>{slot.booked_count ?? 0} / {slot.max_patients}</td>
                <td>
                  <span className={slot.is_available ? styles.available : styles.booked}>
                    {slot.is_available ? "Available" : "Full"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
