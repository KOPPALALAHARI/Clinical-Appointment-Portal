import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try { await logout(refreshToken); } catch (_) {}
    }
    signOut();
    navigate("/login");
  };

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>Clinical Portal</Link>
      <div className={styles.links}>
        {user ? (
          <>
            <span className={styles.greeting}>Hi, {user.name}</span>
            {user.role === "PATIENT" && (
              <>
                <Link to="/patient/doctors">Find Doctors</Link>
                <Link to="/patient/appointments">My Appointments</Link>
              </>
            )}
            {user.role === "DOCTOR" && (
              <>
                <Link to="/doctor/slots">My Slots</Link>
                <Link to="/doctor/appointments">Appointment Requests</Link>
              </>
            )}
            <button onClick={handleLogout} className={styles.logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
