import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDoctors } from "../../api/patients";
import styles from "./Patient.module.css";

export default function DoctorList() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getDoctors()
      .then(({ data }) => setDoctors(data))
      .catch(() => setError("Failed to load doctors"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={styles.center}>Loading doctors...</p>;
  if (error) return <p className={styles.errorText}>{error}</p>;

  return (
    <div className={styles.page}>
      <h2>Available Doctors</h2>
      {doctors.length === 0 ? (
        <p className={styles.empty}>No doctors registered yet.</p>
      ) : (
        <div className={styles.grid}>
          {doctors.map((doc) => (
            <div key={doc.id} className={styles.card}>
              <div className={styles.avatar}>{doc.name[0].toUpperCase()}</div>
              <div className={styles.info}>
                <h3>{doc.name}</h3>
                <p>{doc.email}</p>
              </div>
              <button
                className={styles.btn}
                onClick={() => navigate(`/patient/doctors/${doc.id}/slots`)}
              >
                View Slots
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
