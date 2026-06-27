import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";
import { AuthProvider } from "./context/AuthContext";
import AppointmentRequests from "./pages/doctor/AppointmentRequests";
import ManageSlots from "./pages/doctor/ManageSlots";
import Home from "./pages/Home";
import Login from "./pages/Login";
import DoctorList from "./pages/patient/DoctorList";
import MyAppointments from "./pages/patient/MyAppointments";
import SlotList from "./pages/patient/SlotList";
import Register from "./pages/Register";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Patient routes */}
          <Route
            path="/patient/doctors"
            element={<PrivateRoute role="PATIENT"><DoctorList /></PrivateRoute>}
          />
          <Route
            path="/patient/doctors/:doctorId/slots"
            element={<PrivateRoute role="PATIENT"><SlotList /></PrivateRoute>}
          />
          <Route
            path="/patient/appointments"
            element={<PrivateRoute role="PATIENT"><MyAppointments /></PrivateRoute>}
          />

          {/* Doctor routes */}
          <Route
            path="/doctor/slots"
            element={<PrivateRoute role="DOCTOR"><ManageSlots /></PrivateRoute>}
          />
          <Route
            path="/doctor/appointments"
            element={<PrivateRoute role="DOCTOR"><AppointmentRequests /></PrivateRoute>}
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
