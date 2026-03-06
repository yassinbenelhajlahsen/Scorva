import { apiFetch } from "./client.js";

export const getProfile = ({ token }) =>
  apiFetch("/api/user/profile", { token });

export const updateProfile = (fields, { token }) =>
  apiFetch("/api/user/profile", { method: "PATCH", token, body: fields });

export const deleteAccount = ({ token }) =>
  apiFetch("/api/user/account", { method: "DELETE", token });
