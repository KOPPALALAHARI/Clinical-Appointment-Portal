import client from "./client";

export const register = (data) => client.post("/auth/register", data);
export const login = (data) => client.post("/auth/login", data);
export const refresh = (refreshToken) => client.post("/auth/refresh", { refresh_token: refreshToken });
export const logout = (refreshToken) => client.post("/auth/logout", { refresh_token: refreshToken });
