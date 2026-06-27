import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Home.module.css";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className={styles.hero}>
      <h1>Clinical Appointment Portal</h1>
      <p>Book appointments with doctors quickly and easily.</p>
      {!user ? (
        <div className={styles.cta}>
          <Link to="/register" className={styles.btnPrimary}>Get Started</Link>
          <Link to="/login" className={styles.btnSecondary}>Sign In</Link>
        </div>
      ) : user.role === "PATIENT" ? (
        <div className={styles.cta}>
          <Link to="/patient/doctors" className={styles.btnPrimary}>Find Doctors</Link>
          <Link to="/patient/appointments" className={styles.btnSecondary}>My Appointments</Link>
        </div>
      ) : (
        <div className={styles.cta}>
          <Link to="/doctor/slots" className={styles.btnPrimary}>Manage Slots</Link>
          <Link to="/doctor/appointments" className={styles.btnSecondary}>View Requests</Link>
        </div>
      )}
    </div>
  );
}
