import { useEffect, useState } from "react";
import { getAppointmentRequests, updateAppointmentStatus } from "../../api/doctors";
import styles from "./Doctor.module.css";

function formatDt(dt) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_CLASS = {
  PENDING: styles.statusPending,
  APPROVED: styles.statusApproved,
  REJECTED: styles.statusRejected,
  CANCELLED: styles.statusCancelled,
};

export default function AppointmentRequests() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    getAppointmentRequests()
      .then(({ data }) => setAppointments(data))
      .catch(() => setError("Failed to load appointments"))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (id, status) => {
    setActionId(id);
    try {
      const { data } = await updateAppointmentStatus(id, status);
      setAppointments((prev) => prev.map((a) => (a.id === id ? data : a)));
      showToast(`Appointment ${status.toLowerCase()}.`);
    } catch (err) {
      showToast(err.response?.data?.detail || "Action failed");
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <p className={styles.center}>Loading...</p>;
  if (error) return <p className={styles.errorText}>{error}</p>;

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}
      <h2>Appointment Requests</h2>
      {appointments.length === 0 ? (
        <p className={styles.empty}>No appointment requests yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Slot Start</th>
              <th>Slot End</th>
              <th>Requested On</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((appt) => (
              <tr key={appt.id}>
                <td>{appt.patient?.name ?? "—"}</td>
                <td>{appt.slot ? formatDt(appt.slot.start_time) : "—"}</td>
                <td>{appt.slot ? formatDt(appt.slot.end_time) : "—"}</td>
                <td>{formatDt(appt.created_at)}</td>
                <td>
                  <span className={`${styles.badge} ${STATUS_CLASS[appt.status]}`}>
                    {appt.status}
                  </span>
                </td>
                <td>
                  {appt.status === "PENDING" && (
                    <div className={styles.actions}>
                      <button
                        className={`${styles.btnSm} ${styles.btnApprove}`}
                        disabled={actionId === appt.id}
                        onClick={() => handleAction(appt.id, "APPROVED")}
                      >
                        Approve
                      </button>
                      <button
                        className={`${styles.btnSm} ${styles.btnReject}`}
                        disabled={actionId === appt.id}
                        onClick={() => handleAction(appt.id, "REJECTED")}
                      >
                        Reject
                      </button>
                    </div>
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
