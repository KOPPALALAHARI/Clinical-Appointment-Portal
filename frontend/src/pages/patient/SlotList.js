import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { bookAppointment, getDoctorSlots } from "../../api/patients";
import styles from "./Patient.module.css";

function formatDt(dt) {
  return new Date(dt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SpotsCell({ booked, max }) {
  const remaining = max - booked;
  if (max === 1) {
    return <span className={styles.spotFree}>Available</span>;
  }
  if (remaining === 0) {
    return <span className={styles.spotFull}>Full</span>;
  }
  return (
    <span className={styles.spotPartial}>
      {booked} / {max} booked
      <span className={styles.spotRemaining}> ({remaining} left)</span>
    </span>
  );
}

export default function SlotList() {
  const { doctorId } = useParams();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState(null);
  const [toast, setToast] = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3000);
  };

  const loadSlots = () =>
    getDoctorSlots(doctorId)
      .then(({ data }) => setSlots(data))
      .catch(() => setError("Failed to load slots"))
      .finally(() => setLoading(false));

  useEffect(() => { loadSlots(); }, [doctorId]);

  const handleBook = async (slotId) => {
    setBookingId(slotId);
    try {
      await bookAppointment(slotId);
      showToast("Appointment booked successfully!");
      loadSlots();
    } catch (err) {
      showToast(err.response?.data?.detail || "Booking failed", "error");
    } finally {
      setBookingId(null);
    }
  };

  if (loading) return <p className={styles.center}>Loading slots...</p>;
  if (error) return <p className={styles.errorText}>{error}</p>;

  return (
    <div className={styles.page}>
      {toast.msg && (
        <div className={toast.type === "error" ? styles.toastError : styles.toast}>
          {toast.msg}
        </div>
      )}
      <h2>Available Slots</h2>
      {slots.length === 0 ? (
        <p className={styles.empty}>No available slots for this doctor.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Start</th>
              <th>End</th>
              <th>Availability</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, i) => (
              <tr key={slot.id}>
                <td>{i + 1}</td>
                <td>{formatDt(slot.start_time)}</td>
                <td>{formatDt(slot.end_time)}</td>
                <td>
                  <SpotsCell
                    booked={slot.booked_count ?? 0}
                    max={slot.max_patients ?? 1}
                  />
                </td>
                <td>
                  <button
                    className={styles.btnSm}
                    disabled={bookingId === slot.id}
                    onClick={() => handleBook(slot.id)}
                  >
                    {bookingId === slot.id ? "Booking..." : "Book"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
