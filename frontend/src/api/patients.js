import client from "./client";

export const getDoctors = () => client.get("/patients/doctors");
export const getDoctorSlots = (doctorId) => client.get(`/patients/doctors/${doctorId}/slots`);
export const bookAppointment = (slotId) => client.post("/patients/appointments", { slot_id: slotId });
export const getMyAppointments = () => client.get("/patients/appointments");
export const cancelAppointment = (id) => client.patch(`/patients/appointments/${id}/cancel`);
