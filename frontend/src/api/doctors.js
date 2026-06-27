import client from "./client";

export const createSlot = (data) => client.post("/doctors/slots", data);
export const createSlotsBulk = (data) => client.post("/doctors/slots/bulk", data);
export const getMySlots = () => client.get("/doctors/slots");
export const getAppointmentRequests = () => client.get("/doctors/appointments");
export const updateAppointmentStatus = (id, status) =>
  client.patch(`/doctors/appointments/${id}/status`, { status });
