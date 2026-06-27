import { useEffect, useState } from "react";
import { cancelAppointment, getMyAppointments } from "../../api/patients";
import styles from "./Patient.module.css";

function formatDt(dt) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_CLASS = {
  PENDING: styles.statusPending,
  APPROVED: styles.statusApproved,
  REJECTED: styles.statusRejected,
  CANCELLED: styles.statusCancelled,
};

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    getMyAppointments()
      .then(({ data }) => setAppointments(data))
      .catch(() => setError("Failed to load appointments"))
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (id) => {
    setCancellingId(id);
    try {
      const { data } = await cancelAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? data : a)));
      showToast("Appointment cancelled.");
    } catch (err) {
      showToast(err.response?.data?.detail || "Cancel failed");
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <p className={styles.center}>Loading...</p>;
  if (error) return <p className={styles.errorText}>{error}</p>;

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}
      <h2>My Appointments</h2>
      {appointments.length === 0 ? (
        <p className={styles.empty}>You have no appointments yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Slot Start</th>
              <th>Slot End</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appt) => (
              <tr key={appt.id}>
                <td>{appt.slot?.doctor?.name ?? "—"}</td>
                <td>{appt.slot ? formatDt(appt.slot.start_time) : "—"}</td>
                <td>{appt.slot ? formatDt(appt.slot.end_time) : "—"}</td>
                <td>
                  <span className={`${styles.badge} ${STATUS_CLASS[appt.status]}`}>
                    {appt.status}
                  </span>
                </td>
                <td>
                  {appt.status === "PENDING" && (
                    <button
                      className={`${styles.btnSm} ${styles.btnDanger}`}
                      disabled={cancellingId === appt.id}
                      onClick={() => handleCancel(appt.id)}
                    >
                      {cancellingId === appt.id ? "Cancelling..." : "Cancel"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
