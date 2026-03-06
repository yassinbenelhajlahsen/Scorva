import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { createContext } from "react";

export const AuthContext = createContext(null);

export const mockSession = {
  access_token: "test-token-123",
  user: {
    id: "user-uuid-123",
    email: "test@example.com",
    app_metadata: { providers: ["email"] },
  },
};

export function renderWithProviders(ui, { session = null, openAuthModal = () => {}, ...renderOptions } = {}) {
  function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={{ session, openAuthModal }}>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthContext.Provider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
